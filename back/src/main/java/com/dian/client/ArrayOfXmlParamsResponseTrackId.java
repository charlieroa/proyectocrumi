
package com.dian.client;

import java.util.ArrayList;
import java.util.List;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for ArrayOfXmlParamsResponseTrackId complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="ArrayOfXmlParamsResponseTrackId">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="XmlParamsResponseTrackId" type="{http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId}XmlParamsResponseTrackId" maxOccurs="unbounded" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "ArrayOfXmlParamsResponseTrackId", namespace = "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId", propOrder = {
    "xmlParamsResponseTrackId"
})
public class ArrayOfXmlParamsResponseTrackId {

    @XmlElement(name = "XmlParamsResponseTrackId", nillable = true)
    protected List<XmlParamsResponseTrackId> xmlParamsResponseTrackId;

    /**
     * Gets the value of the xmlParamsResponseTrackId property.
     * 
     * <p>
     * This accessor method returns a reference to the live list,
     * not a snapshot. Therefore any modification you make to the
     * returned list will be present inside the JAXB object.
     * This is why there is not a <CODE>set</CODE> method for the xmlParamsResponseTrackId property.
     * 
     * <p>
     * For example, to add a new item, do as follows:
     * <pre>
     *    getXmlParamsResponseTrackId().add(newItem);
     * </pre>
     * 
     * 
     * <p>
     * Objects of the following type(s) are allowed in the list
     * {@link XmlParamsResponseTrackId }
     * 
     * 
     */
    public List<XmlParamsResponseTrackId> getXmlParamsResponseTrackId() {
        if (xmlParamsResponseTrackId == null) {
            xmlParamsResponseTrackId = new ArrayList<XmlParamsResponseTrackId>();
        }
        return this.xmlParamsResponseTrackId;
    }

}
