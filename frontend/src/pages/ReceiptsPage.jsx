import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileImage, 
  FileText, 
  Check, 
  X, 
  Eye,
  Download,
  Trash2,
  Plus
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const ReceiptsPage = () => {
  const { user } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (files) => {
    console.log('handleFileUpload called with:', files);
    if (!files || files.length === 0) return;

    setProcessing(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const file = files[0];
      const fileType = file.type;
      
      // Validate file type
      const isImage = fileType.startsWith('image/');
      const isPDF = fileType === 'application/pdf';
      
      if (!isImage && !isPDF) {
        throw new Error('Please upload an image (JPG, PNG, etc.) or PDF file');
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      let response;
      if (isImage) {
        response = await apiClient.uploadReceiptImage(file);
      } else {
        response = await apiClient.uploadReceiptPDF(file);
      }
      console.log('Extracted response:', response);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Add to uploaded files list
      const newFile = {
        id: Date.now(),
        name: file.name,
        type: fileType,
        size: file.size,
        uploadedAt: new Date(),
        extractedData: response.data
      };

      setUploadedFiles(prev => [newFile, ...prev]);
      setExtractedData(response.data);
      console.log('Extracted data set:', response.data);

    } catch (error) {
      console.error('Upload failed:', error);
      setError(error.message || 'Failed to process receipt');
    } finally {
      setProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    console.log('Drop event:', e);
    const files = Array.from(e.dataTransfer.files);
    console.log('Files dropped:', files);
    handleFileUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
    }).format(amount);
  };

  const createTransactionFromReceipt = async (receiptData) => {
    try {
      setProcessing(true);
      await apiClient.createTransactionFromReceipt(receiptData);
      setSuccess('Transaction created successfully from receipt data!');
    } catch (error) {
      setError(error.message || 'Failed to create transaction');
    } finally {
      setProcessing(false);
    }
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    if (extractedData && uploadedFiles.find(f => f.id === fileId)?.extractedData === extractedData) {
      setExtractedData(null);
    }
  };

  const getTotalAmount = (data) => {
    if (data.totalAmount && data.totalAmount > 0) return data.totalAmount;
    if (data.suggestedTransaction?.amount && data.suggestedTransaction.amount > 0) return data.suggestedTransaction.amount;
    if (Array.isArray(data.items) && data.items.length > 0) {
      const sum = data.items.reduce((sum, item) => sum + (item.price || 0), 0);
      if (sum > 0) return sum;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Receipts</h1>
        <p className="text-muted-foreground">
          Upload and process receipts to automatically extract transaction data
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Receipt</CardTitle>
          <CardDescription>
            Upload images (JPG, PNG) or PDF files of your receipts for automatic data extraction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-muted rounded-full">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop your receipt here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse files
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <FileImage className="h-4 w-4" />
                  <span>Images</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="h-4 w-4" />
                  <span>PDF</span>
                </div>
              </div>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Processing receipt...</span>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Extracted Data */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
            <CardDescription>
              Review and edit the extracted information before creating a transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
  <form
    onSubmit={e => {
      e.preventDefault();
      setExtractedData(editData);
      setIsEditing(false);
    }}
    className="space-y-4"
  >
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label>Merchant/Store</Label>
        <Input
          value={editData.merchant || editData.merchantName || ''}
          onChange={e =>
            setEditData(data => ({
              ...data,
              merchant: e.target.value,
              merchantName: e.target.value,
            }))
          }
        />
      </div>
      <div>
        <Label>Total Amount</Label>
        <Input
          type="number"
          value={editData.totalAmount || ''}
          onChange={e =>
            setEditData(data => ({
              ...data,
              totalAmount: parseFloat(e.target.value) || 0,
            }))
          }
        />
      </div>
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={
            editData.date
              ? new Date(editData.date).toISOString().split('T')[0]
              : ''
          }
          onChange={e =>
            setEditData(data => ({
              ...data,
              date: e.target.value,
            }))
          }
        />
      </div>
      <div>
        <Label>Category</Label>
        <Input
          value={editData.suggestedCategory || ''}
          onChange={e =>
            setEditData(data => ({
              ...data,
              suggestedCategory: e.target.value,
            }))
          }
        />
      </div>
    </div>
    <div className="flex space-x-2">
      <Button type="submit">Save</Button>
      <Button variant="outline" onClick={() => setIsEditing(false)}>
        Cancel
      </Button>
    </div>
  </form>
) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Merchant/Store</Label>
                  <p className="text-lg font-medium">
                    {extractedData.merchant || extractedData.merchantName || extractedData.suggestedTransaction?.description || 'Not detected'}
                  </p>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <p className="text-lg font-medium text-green-600">
                    {getTotalAmount(extractedData) > 0
                      ? formatCurrency(getTotalAmount(extractedData))
                      : 'Not detected'}
                  </p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-lg font-medium">
                    {extractedData.date
                      ? new Date(extractedData.date).toLocaleDateString()
                      : extractedData.suggestedTransaction?.date
                        ? new Date(extractedData.suggestedTransaction.date).toLocaleDateString()
                        : 'Not detected'}
                  </p>
                </div>
                <div>
                  <Label>Category</Label>
                  <Badge variant="outline">
                    {extractedData.suggestedCategory ||
                     extractedData.suggestedTransaction?.category ||
                     'other'}
                  </Badge>
                </div>
              </div>
            )}

            {extractedData.items && extractedData.items.length > 0 && (
              <div>
                <Label>Items</Label>
                <div className="mt-2 space-y-2">
                  {extractedData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span>{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extractedData.rawText && (
              <div>
                <Label>Raw Extracted Text</Label>
                <Textarea
                  value={extractedData.rawText}
                  readOnly
                  className="mt-2 h-32"
                />
              </div>
            )}

            <div className="flex space-x-2">
              <Button 
                onClick={() => createTransactionFromReceipt({
                  amount: getTotalAmount(extractedData),
                  category:
                    extractedData.suggestedCategory && extractedData.suggestedCategory.trim() !== ''
                      ? extractedData.suggestedCategory
                      : extractedData.suggestedTransaction?.category && extractedData.suggestedTransaction.category.trim() !== ''
                        ? extractedData.suggestedTransaction.category
                        : 'other',
                  date: extractedData.date || extractedData.suggestedTransaction?.date || new Date().toISOString(),
                  description: extractedData.merchant || extractedData.merchantName || extractedData.suggestedTransaction?.description || 'Receipt',
                  type: extractedData.suggestedTransaction?.type || 'expense',
                  user: user?._id,
                })}
                disabled={processing || getTotalAmount(extractedData) === 0}
              >
                {processing ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Files History */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>
              Your recently processed receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded">
                      {file.type.startsWith('image/') ? (
                        <FileImage className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <span>{file.uploadedAt.toLocaleDateString()}</span>
                        {file.extractedData?.totalAmount && (
                          <Badge variant="outline">
                            {formatCurrency(file.extractedData.totalAmount)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExtractedData(file.extractedData)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Better Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Ensure the receipt is clearly visible and well-lit</li>
            <li>• Avoid blurry or tilted images</li>
            <li>• Make sure all text is readable</li>
            <li>• For PDF files, ensure they contain searchable text</li>
            <li>• Supported formats: JPG, PNG, PDF</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptsPage;

